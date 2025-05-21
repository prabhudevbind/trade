"use client";
import React, { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Plus, Edit3, Trash2, MoreVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGetRolesDataQuery,
  useCreateRoleMutation,
  useDeleteRoleMutation,
} from "@/store/api/role.api";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Roles() {
  const { data: rolesData = {} } = useGetRolesDataQuery({ page: 1, limit: 10 });
  const [createRole] = useCreateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const [newRolePopover, setNewRolePopover] = useState(false);
  const [newRoleData, setNewRoleData] = useState({ name: "", description: "" });

  const handleCreateRole = useCallback(async () => {
    try {
      await createRole(newRoleData);
      setNewRolePopover(false);
    } catch (error) {
      console.error("Failed to create role:", error);
    }
  }, [createRole, newRoleData]);

  const handleDeleteRole = useCallback(async (roleId) => {
    try {
      await deleteRole(roleId);
    } catch (error) {
      console.error("Failed to delete role:", error);
    }
  }, [deleteRole]);

  return (
    <div className="  mx-auto space-y-6">
      <Card className="p-6">
        <CardHeader>
          <CardTitle className="text-2xl">Manage Roles</CardTitle>
          <CardDescription>Create and manage user roles in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <Popover open={newRolePopover} onOpenChange={setNewRolePopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center">
                  <Plus className="w-4 h-4 mr-2" /> Add New Role
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Create New Role</h4>
                  <Input
                    placeholder="Role Name"
                    value={newRoleData.name}
                    onChange={(e) => setNewRoleData({ ...newRoleData, name: e.target.value })}
                  />
                  <Input
                    placeholder="Description"
                    value={newRoleData.description}
                    onChange={(e) => setNewRoleData({ ...newRoleData, description: e.target.value })}
                  />
                  <Button onClick={handleCreateRole} className="w-full">
                    Create Role
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <ScrollArea >
            <div className="border rounded-lg">
              <Table className=" rounded-lg  ">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="rounded-xl">
                  {rolesData.roles?.map((role) => (
                    <TableRow key={role.id} className="rounded-md">
                      <TableCell className="font-medium">{role.id}</TableCell>
                      <TableCell>{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell className="flex space-x-2">
                        {/* <Button variant="ghost" size="icon" className="hover:bg-gray-200">
                        <Edit3 className="w-4 h-4" />
                      </Button> */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRole(role.id)}
                          className="hover:bg-gray-200"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                        <div>


                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 justify-center text items-center gap-4 px-4">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Link to={`/permissions/${role.id}`} className="w-full">
                                  Manage Permissions
                                </Link>
                              </DropdownMenuItem>
                              {/* <DropdownMenuItem>
                              <Link to={`/edit-role/${role.id}`} className="w-full">
                                Edit Role
                              </Link>
                            </DropdownMenuItem> */}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}