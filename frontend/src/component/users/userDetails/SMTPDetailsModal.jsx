import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Edit, Save, X } from 'lucide-react';
import { toast } from "react-toastify";
import { useCreateSmtpDetailsMutation, useGetSmtpDetailsByUserIdQuery } from '@/store/api/smtp.api';

function SMTPDetailsModal({
    isOpen,
    onClose,
    userId = '' // Default to an empty string to avoid undefined
}) {
    // Guard clause: Don't render if userId is invalid
    if (!userId) {
        return null;
    }

    const [createSmpt] = useCreateSmtpDetailsMutation();
    const { data: smtpData, isLoading, isError,refetch } = useGetSmtpDetailsByUserIdQuery(userId, { 
        skip: !isOpen // Skip the query if modal is not open
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
        encryption: 'SSL',
        userId: userId
    });

    // Reset edit mode when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setIsEditMode(false);
        }
    }, [isOpen]);

    // Sync formData once smtpData is available
    useEffect(() => {
        if (smtpData) {
            setFormData({
                host: smtpData?.host || '',
                port: smtpData?.port || '',
                username: smtpData?.username || '',
                password: smtpData?.password || '',
                encryption: 'SSL',
                userId: userId
            });
        }
    }, [smtpData, userId]);

    // Handle copy to clipboard
    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied to clipboard');
        }).catch(err => {
            toast.error('Failed to copy');
        });
    };

    // Handle input changes in edit mode
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle form submission
    const handleSubmit = async () => {
        try {
            await createSmpt(formData).unwrap();
            // toast.success('SMTP details updated successfully');
            setIsEditMode(false);
            refetch();
        } catch (error) {
            toast.error('Failed to update SMTP details');
            console.error(error);
        }
    };

    // Handle modal close with proper cleanup
    const handleModalClose = () => {
        setIsEditMode(false);
        onClose();
    };

    // Render input or static text based on edit mode
    const renderField = (label, name, value, type = 'text') => {
        if (isEditMode) {
            return (
                <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right font-medium">{label}</label>
                    <Input
                        name={name}
                        value={formData[name]}
                        onChange={handleInputChange}
                        type={type}
                        className="col-span-2"
                        placeholder={`Enter ${label.toLowerCase()}`}
                    />
                </div>
            );
        }

        if (isLoading) {
            return <p>Loading...</p>;
        }

        if (isError) {
            return <p>Error loading SMTP details</p>;
        }

        return (
            <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right font-medium">{label}</label>
                <div className="col-span-2 flex items-center">
                    <span>
                        {name === 'password' ? '********' : value}
                    </span>
                    {name !== 'password' && value && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2"
                            onClick={() => handleCopyToClipboard(value.toString())}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleModalClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>SMTP Details {userId ? `for ${userId}` : ''}</DialogTitle>
                    <DialogDescription>
                        SMTP configuration details for email services
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {renderField('Host', 'host', formData.host)}
                    {renderField('Port', 'port', formData.port, 'number')}
                    {renderField('Username', 'username', formData.username)}
                    {/* {renderField('Encryption', 'encryption', formData.encryption)} */}
                    {renderField('Password', 'password', formData.password, 'password')}
                </div>

                <DialogFooter>
                    {!isEditMode ? (
                        <Button 
                            variant="outline" 
                            onClick={() => setIsEditMode(true)}
                        >
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    ) : (
                        <>
                            <Button 
                                variant="outline" 
                                onClick={() => setIsEditMode(false)}
                                className="mr-2"
                            >
                                <X className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button 
                                onClick={handleSubmit}
                            >
                                <Save className="mr-2 h-4 w-4" /> Save
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default SMTPDetailsModal;