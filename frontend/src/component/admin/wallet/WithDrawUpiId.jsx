import React, { useState } from 'react'
import { useUpdateUpiIdMutation, useGetUserByIdQuery } from '@/store/api/userSliceApi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export default function WithDrawUpiId() {
  const { data: user, refetch } = useGetUserByIdQuery();
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [updateUpiId, { isLoading }] = useUpdateUpiIdMutation();
  const [msg, setMsg] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await updateUpiId(upiId).unwrap();
      setMsg('UPI ID updated!');
      refetch();
    } catch (err) {
      setMsg('Failed to update UPI ID');
    }
  };

  return (
    <Card className="max-w-md mt-4">
      <CardHeader>
        <CardTitle className="text-base">Withdrawal UPI ID</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleUpdate}
          className='grid grid-cols-3 gap-2 mb-2'
        >
          <Input
            type="text"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="Enter UPI ID"
            className="w-full col-span-2 mb-2 sm:w-40"
          />
          <Button
            type="submit"
            disabled={isLoading || !upiId}
            className="w-full sm:w-auto"
            size="sm"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
          {msg && (
            <div className="col-span-3">
              <Alert variant={msg.includes('updated') ? 'success' : 'destructive'} className="p-1 px-2 text-xs mt-1">
                <AlertDescription>{msg}</AlertDescription>
              </Alert>
            </div>
          )}
        </form>
       
      </CardContent>
    </Card>
  );
}
