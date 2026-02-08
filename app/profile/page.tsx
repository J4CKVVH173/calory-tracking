'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileForm } from '@/components/profile/profile-form'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-8 max-w-2xl">
      <ProfileForm />
    </div>
  )
}
