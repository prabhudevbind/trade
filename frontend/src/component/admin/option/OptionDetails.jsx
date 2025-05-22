import React from 'react';
import { useParams, useLocation } from 'react-router-dom';

export default function OptionDetails() {
  const { optionId } = useParams(); // Extracts :optionId from the URL
  const location = useLocation();

  // Parse query parameters
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get('type');

  return (
    <div>
      <h2>Option Details</h2>
      <p><strong>Option ID:</strong> {optionId}</p>
      <p><strong>Type:</strong> {type}</p>
    </div>
  );
}
