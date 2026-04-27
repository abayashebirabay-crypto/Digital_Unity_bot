import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { uploadPayment } from '../services/api';
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
      const response = await uploadPayment(formData);
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
    <div className="bg-white rounded-2xl p-5 shadow-lg mb-4">
      <h3 className="text-lg font-bold text-purple-700 mb-4">💳 Make Payment</h3>
      
      {selectedNumber && (
        <div className="bg-gray-100 rounded-xl p-3 text-center font-semibold text-gray-700 mb-4">
          Selected: <strong className="text-purple-600">{selectedNumber}</strong> | 
          Amount: <strong className="text-green-600">{numberPrices[selectedNumber]} ETB</strong>
        </div>
      )}
      
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span>🏦 Bank:</span>
          <strong>Commercial Bank of Ethiopia</strong>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span>📋 Account:</span>
          <strong>100013456789</strong>
        </div>
        <div className="flex justify-between items-center py-2">
          <span>👤 Name:</span>
          <strong>Digital Unity</strong>
        </div>
      </div>
      
      <div 
        onClick={() => document.getElementById('fileInput').click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
      >
        📸 Click to upload payment screenshot
      </div>
      
      <input 
        id="fileInput" 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange} 
      />
      
      {file && (
        <div className="text-sm text-gray-600 text-center mt-3">
          Selected: {file.name}
        </div>
      )}
      
      <button 
        onClick={handleSubmit} 
        disabled={uploading}
        className="w-full mt-5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
        ) : (
          'Submit Payment'
        )}
      </button>
    </div>
  );
};

export default PaymentCard;