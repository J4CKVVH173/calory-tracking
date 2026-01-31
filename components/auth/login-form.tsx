'use client'

import React from "react"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { getUserByUsername, saveUser } from '@/lib/storage'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Пароли не совпадают')
          setIsLoading(false)
          return
        }
        if (password.length < 4) {
          setError('Пароль должен быть минимум 4 символа')
          setIsLoading(false)
          return
        }
        if (getUserByUsername(username)) {
          setError('Пользователь с таким именем уже существует')
          setIsLoading(false)
          return
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setError(data.error || 'Ошибка регистрации')
          setIsLoading(false)
          return
        }

        saveUser(data.user)
        login(data.user.id)
        router.push('/profile')
      } else {
        const existingUser = getUserByUsername(username)
        if (!existingUser) {
          setError('Пользователь не найден')
          setIsLoading(false)
          return
        }

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, storedHash: existingUser.passwordHash }),
        })

        const data = await response.json()
        if (!response.ok) {
          setError(data.error || 'Неверный пароль')
          setIsLoading(false)
          return
        }

        login(existingUser.id)
        router.push('/dashboard')
      }
    } catch {
      setError('Произошла ошибка. Попробуйте снова.')
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center text-balance">
          {isRegister ? 'Регистрация' : 'Вход в систему'}
        </CardTitle>
        <CardDescription className="text-center">
          {isRegister
            ? 'Создайте аккаунт для отслеживания калорий'
            : 'Введите данные для входа в приложение'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Имя пользователя</Label>
            <Input
              id="username"
              type="text"
              placeholder="Введите имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          {isRegister && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive animate-in fade-in duration-200">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Загрузка...' : isRegister ? 'Зарегистрироваться' : 'Войти'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
            }}
            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
