import React, { useState, useEffect } from 'react';
import { useGetActivityLogsQuery } from '@/store/api/activityLogApiSlice';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const defaultData = [
    {
        "userId": 1,
        "activityType": "LOGIN_SUCCESS",
        "description": "Successful user login",
        "ipAddress": "::1",
        "user": {
            "username": "prabhudev",
            "firstName": "Prabhudev",
            "lastName": "bind"
        }
    },
    // Add more data entries as needed
];

export default function Activities() {
    const { data: activeData } = useGetActivityLogsQuery();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [filteredData, setFilteredData] = useState(defaultData);

    useEffect(() => {
        let dataToFilter = activeData || defaultData;

        let filtered = dataToFilter;
        if (searchTerm) {
            filtered = dataToFilter.filter(item =>
                item.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.userId.toString().includes(searchTerm)
            );
        }

        if (sortConfig.key !== null) {
            filtered = [...filtered].sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        setFilteredData(filtered);
    }, [searchTerm, sortConfig, activeData]);

    const requestSort = key => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="p-4 rounded-lg bg-white shadow-md">
            <Input
                type="text"
                placeholder="Search by username or ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
            />
            <Table className="border">
                <TableHeader>
                    <TableRow className="border">
                        <TableHead className="cursor-pointer" onClick={() => requestSort('userId')}>
                            User ID {sortConfig.key === 'userId' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('activityType')}>
                            Activity Type {sortConfig.key === 'activityType' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('description')}>
                            Description {sortConfig.key === 'description' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('ipAddress')}>
                            IP Address {sortConfig.key === 'ipAddress' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                        </TableHead>
                        <TableHead>User</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>{item.userId}</TableCell>
                            <TableCell>{item.activityType}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.ipAddress}</TableCell>
                            {/* <TableCell>{item.user.firstName} {item.user.lastName} ({item.user.username})</TableCell> */}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}