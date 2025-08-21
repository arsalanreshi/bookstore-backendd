const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  isbn: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  imageUrl: {
    type: String,
    trim: true
  },
  publishedDate: {
    type: Date
  },
  publisher: {
    type: String,
    trim: true
  },
  // PDF-related fields
  hasPdf: {
    type: Boolean,
    default: false
  },
  pdfUrl: {
    type: String,
    trim: true
  },
  pdfPrice: {
    type: Number,
    min: 0
  },
  allowPdfPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Book', bookSchema);
