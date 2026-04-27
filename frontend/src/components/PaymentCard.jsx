import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { submitPayment } from '../services/api';
import './PaymentCard.css';

const PaymentCard = ({ userId, selectedNumber, numberPrices, onPaymentSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!selectedNumber) {
      toast.error('Select a number first!');
      return;
    }
    if (!file) {
      toast.error('Upload screenshot first!');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('amount', numberPrices[selectedNumber]);
    formData.append('number', selectedNumber);
    formData.append('file', file);

    try {
      const response = await submitPayment(formData);
      if (response.data.success) {
        toast.success('Payment submitted! Waiting for approval.');
        setTimeout(() => onPaymentSuccess(), 2000);
      } else {
        toast.error(response.data.message || 'Payment failed');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="payment-card">
      <h3>💳 Make Payment</h3>
      {selectedNumber && (
        <div className="selected-display">
          Selected: <strong>{selectedNumber}</strong> | 
          Amount: <strong>{numberPrices[selectedNumber]} ETB</strong>
        </div>
      )}
      <div className="payment-info">
        <div className="payment-method"><span>🏦 Bank:</span><strong>Commercial Bank of Ethiopia</strong></div>
        <div className="payment-method"><span>📋 Account:</span><strong>100013456789</strong></div>
        <div className="payment-method"><span>👤 Name:</span><strong>Digital Unity</strong></div>
      </div>
      <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}>
        📸 Click to upload payment screenshot
      </div>
      <input id="fileInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      {file && <div className="file-name">Selected: {file.name}</div>}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={uploading}>
        {uploading ? 'Submitting...' : 'Submit Payment'}
      </button>
    </div>
  );
};

export default PaymentCard;