import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { uploadPayment } from '../services/api';
import { motion } from 'framer-motion';

const PaymentCard = ({ userId, selectedNumber, gameConfig, onPaymentSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Guard clause
  if (!selectedNumber || !gameConfig) {
    return null;
  }

  const pricePerNumber = gameConfig.price_per_number || 100;
  const currentRound = gameConfig.round || gameConfig.game_id || '?';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create preview URL
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
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

    const amount = pricePerNumber;
    
    console.log('Payment submission:', { userId, selectedNumber, amount, round: currentRound });

    setUploading(true);
    const formData = new FormData();
    formData.append('user_id', userId.toString());
    formData.append('amount', amount.toString());
    formData.append('number', selectedNumber.toString());
    formData.append('file', file);

    try {
      const response = await uploadPayment(formData);
      console.log('Payment response:', response.data);
      
      if (response.data.success) {
        toast.success(`Payment submitted for Round #${currentRound}! Waiting for approval.`);
        // Clear preview URL
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setTimeout(() => {
          onPaymentSuccess();
        }, 2000);
      } else {
        toast.error(response.data.message || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.message || 'Network error');
    } finally {
      setUploading(false);
      setFile(null);
      setPreviewUrl(null);
      const fileInput = document.getElementById('paymentFileInput');
      if (fileInput) fileInput.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 border border-white/20 shadow-xl"
    >
      <h3 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
        💳 Make Payment - Round #{currentRound}
      </h3>
      
      {selectedNumber && (
        <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-xl p-3 text-center backdrop-blur-sm mb-4">
          <span className="text-white/70">Selected Number: </span>
          <span className="text-2xl font-bold text-purple-300">{selectedNumber}</span>
          <div className="text-sm text-white/60 mt-1">
            Amount: <span className="text-green-400 font-semibold">{pricePerNumber} ETB</span>
          </div>
        </div>
      )}
      
      {/* Upload Area */}
      <div 
        onClick={() => {
          const fileInput = document.getElementById('paymentFileInput');
          if (fileInput) fileInput.click();
        }}
        className="border-2 border-dashed border-purple-500/50 rounded-xl p-5 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-500/10 transition-all backdrop-blur-sm"
      >
        {previewUrl ? (
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Payment preview" 
              className="max-h-32 mx-auto rounded-lg object-contain"
            />
            <div className="text-sm text-purple-300 mt-2">Tap to change image</div>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-2">📸</div>
            <div className="text-white/80">Click to upload payment screenshot</div>
            <div className="text-xs text-white/40 mt-1">JPG, PNG (Max 5MB)</div>
          </>
        )}
      </div>
      
      <input 
        id="paymentFileInput" 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange} 
      />
      
      {file && !previewUrl && (
        <div className="text-sm text-purple-300 text-center mt-3">
          Selected: {file.name}
        </div>
      )}
      
      <motion.button 
        onClick={handleSubmit} 
        disabled={uploading || !selectedNumber || !file}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
          '💸 Submit Payment'
        )}
      </motion.button>

      {/* Instructions */}
      <div className="mt-4 text-xs text-white/40 text-center">
        <p>📌 Make sure the screenshot is clear and shows transaction details</p>
        <p>⏳ Payment will be reviewed by admin within 24 hours</p>
      </div>
    </motion.div>
  );
};

export default PaymentCard;