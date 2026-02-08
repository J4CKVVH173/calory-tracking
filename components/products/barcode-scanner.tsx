'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, X, Loader2, ScanBarcode, KeyboardIcon } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [hasNativeDetector, setHasNativeDetector] = useState(false)

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  const handleDetected = useCallback((code: string) => {
    stopCamera()
    onScan(code)
  }, [stopCamera, onScan])

  useEffect(() => {
    if (mode !== 'camera') return

    let cancelled = false

    const startCamera = async () => {
      setIsStarting(true)
      setCameraError(null)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setIsStarting(false)

        // Check for native BarcodeDetector
        const hasBD = typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis
        setHasNativeDetector(hasBD)

        if (hasBD) {
          // Use native BarcodeDetector API
          // @ts-expect-error -- BarcodeDetector is not in TS lib yet
          const detector = new globalThis.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
          })

          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                handleDetected(barcodes[0].rawValue)
              }
            } catch {
              // Ignore detection errors
            }
          }, 300)
        }
      } catch (err) {
        if (cancelled) return
        setIsStarting(false)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setCameraError('Доступ к камере запрещен. Разрешите доступ в настройках браузера.')
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setCameraError('Камера не найдена на этом устройстве.')
        } else {
          setCameraError(`Не удалось запустить камеру: ${msg}`)
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [mode, stopCamera, handleDetected])

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (code) {
      onScan(code)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">Сканер штрих-кода</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={mode === 'camera' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setMode('camera')}
            >
              <Camera className="h-3.5 w-3.5 mr-1" />
              Камера
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                stopCamera()
                setMode('manual')
              }}
            >
              <KeyboardIcon className="h-3.5 w-3.5 mr-1" />
              Вручную
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-1"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Camera mode */}
        {mode === 'camera' && (
          <div className="relative bg-black">
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80">
                <Loader2 className="h-8 w-8 animate-spin text-white mb-3" />
                <span className="text-white text-sm">Запуск камеры...</span>
              </div>
            )}

            {cameraError && (
              <div className="p-6 text-center bg-muted">
                <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">{cameraError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    stopCamera()
                    setMode('manual')
                  }}
                  className="bg-transparent"
                >
                  <KeyboardIcon className="h-4 w-4 mr-1.5" />
                  Ввести код вручную
                </Button>
              </div>
            )}

            {!cameraError && (
              <>
                <video
                  ref={videoRef}
                  className="w-full aspect-[4/3] object-cover"
                  playsInline
                  muted
                />
                {/* Scan overlay with viewfinder */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-32 border-2 border-white/80 rounded-xl relative">
                    {/* Corner accents */}
                    <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-primary rounded-tl-lg" />
                    <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-primary rounded-tr-lg" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-primary rounded-bl-lg" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-primary rounded-br-lg" />
                    {/* Animated scan line */}
                    <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
                  </div>
                </div>
                {/* Status text */}
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                    {hasNativeDetector
                      ? 'Наведите камеру на штрих-код'
                      : 'Камера активна. Распознавание не поддерживается - введите код вручную.'}
                  </span>
                </div>
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* If no native detector, show manual input alongside camera */}
            {!isStarting && !cameraError && !hasNativeDetector && (
              <div className="p-3 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    placeholder="Введите код с упаковки"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleManualSubmit()
                    }}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleManualSubmit}
                    disabled={!manualCode.trim()}
                  >
                    Найти
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Введите числовой код штрих-кода с упаковки продукта (EAN-13, UPC и другие)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="4600682000013"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleManualSubmit()
                }}
                className="text-lg font-mono tracking-wider"
                autoFocus
              />
              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
              >
                Найти
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
