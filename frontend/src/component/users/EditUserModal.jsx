'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "react-toastify"
import { useGetUserByIdQuery, useUpdateUserMutation } from '@/store/api/userSliceApi'
import BreadcrumbComp from '@/utils/BreadcrumbComp'
import { Skeleton } from "@/components/ui/skeleton"
import { User, Mail, AtSign, UserCircle } from 'lucide-react'

export default function EditUserModal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [updateUser] = useUpdateUserMutation()
  const { data: user, isLoading } = useGetUserByIdQuery(id)
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
  })

  useEffect(() => {
    if (user) {
      setUserData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
      })
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setUserData(prevState => ({
      ...prevState,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateUser({ id: id, userData }).unwrap()
      toast.success('User updated successfully')
      navigate('/users')
    } catch (error) {
      toast.error('Failed to update user')
    }
  }

  const breadcrumbItems = [
    { path: '/', label: 'Home' },
    { path: '/Users', label: 'Read Users' },
    { path: '/Users', label: 'Edit Users' },
    { path: id, label: userData?.firstName + ' '+ userData?.lastName },
  ];

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <BreadcrumbComp items={breadcrumbItems} />
      <Card>
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
          <CardDescription>Make changes to the user's profile here. Click save when you're done.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  First Name
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={userData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={userData.lastName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={userData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <AtSign className="h-4 w-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={userData.username}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => navigate('/users')}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

