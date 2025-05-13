"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Keyboard, User, LogOut, Upload, Loader2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast, ToastContainer } from "react-toastify"

export default function ProfilePage() {
  const [profile, setProfile] = useState<{
    id: string
    username: string | null
    email: string | null
    avatar_url: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()
  

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true)

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", user.id)
          .single()

        if (profileData) {
          setProfile({
            id: profileData.id,
            username: profileData.username,
            email: user.email || "",
            avatar_url: profileData.avatar_url,
          })
          setUsername(profileData.username || "")
          setAvatarUrl(profileData.avatar_url)
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        toast.error("Failed to load profile data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [router, supabase, toast])

  const handleUpdateProfile = async () => {
    if (!profile) return

    try {
      setIsUpdating(true)
      setUploadError(null)

      // If we have a base64 avatar, store it directly in the profile
      const updateData: { username: string; avatar_url?: string; updated_at: string } = {
        username,
        updated_at: new Date().toISOString(),
      }

      if (avatarBase64) {
        updateData.avatar_url = avatarBase64
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", profile.id)

      if (error) throw error

     toast.success("Profile updated!")
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username,
              avatar_url: avatarBase64 || prev.avatar_url,
            }
          : null,
      )

      if (avatarBase64) {
        setAvatarUrl(avatarBase64)
      }
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast.error("update failed!");
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    try {
      setIsUploading(true)
      setUploadError(null)

      // Check if file is an image
      if (!file.type.startsWith("image/")) {
      toast.error("Pls upload valid image files")
        return
      }

      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large");
        return
      }

      // Try the direct storage approach first
      try {
        // Upload file to Supabase Storage
        const fileExt = file.name.split(".").pop()
        const fileName = `${profile.id}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}`

        // Upload the file
        const { error: uploadError, data } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true })

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath)
        const publicUrl = publicUrlData.publicUrl

        // Update profile with avatar URL
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id)

        if (updateError) throw updateError

        setAvatarUrl(publicUrl)
        setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : null))
        setAvatarBase64(null)
        toast.success("avatar uploaded sucessfully");
      } catch (storageError: any) {
        console.error("Storage upload failed, falling back to base64:", storageError)
        setUploadError(`Storage upload failed: ${storageError.message}. Using base64 fallback instead.`)

        // Fallback to base64 encoding
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            const base64String = e.target.result as string
            setAvatarBase64(base64String)
            setAvatarUrl(base64String)

            
          }
        }
        reader.readAsDataURL(file)
      }
    } catch (error: any) {
      console.error("Error handling avatar:", error)
      setUploadError(error.message || "Failed to process avatar")
      toast.error("Upload failed!")
    } finally {
      setIsUploading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Keyboard className="h-6 w-6" />
            <span>Codesist</span>
          </Link>
          <nav className="ml-auto flex gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
              <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            {uploadError && (
              toast.error("Upload error")
            )}

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:w-auto">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your profile information and avatar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="flex flex-col items-center gap-4">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={avatarUrl || ""} alt={profile?.username || "User"} className="object-cover"/>
                          <AvatarFallback className="text-2xl">
                            {profile?.username?.charAt(0).toUpperCase() || <User className="h-12 w-12" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-center gap-2">
                          <Label
                            htmlFor="avatar-upload"
                            className="cursor-pointer flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          >
                            {isUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {isUploading ? "Uploading..." : "Upload Avatar"}
                          </Label>
                          <Input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                            disabled={isUploading}
                          />
                          <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Your username"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" value={profile?.email || ""} disabled />
                          <p className="text-xs text-muted-foreground">
                            Your email address is managed through your account settings.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="account" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account preferences and security.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Email Address</h3>
                      <p className="text-sm text-muted-foreground">
                        Your email address is <span className="font-medium">{profile?.email}</span>
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Password</h3>
                      <p className="text-sm text-muted-foreground">Change your password to keep your account secure.</p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                    <Link href="/reset-password">
                      <Button variant="outline">Change Password</Button>
                    </Link>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Codesist. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/about" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              About
            </Link>
            <Link href="/privacy" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              Terms
            </Link>
          </div>
        </div>
      </footer>
      <ToastContainer/>
    </div>
  )
}
