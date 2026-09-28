const express = require('express');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../db');
const { upload, UPLOAD_DIR } = require('../middleware/upload');
const { PRIORITIES, getRecurrenceCount, computeSuggestedPriority, computeSlaDueAt } = require('../lib/priority');
const { sendImmediateAlertIfNeeded } = require('../lib/alerts');
const { requireAdmin } = require('../middleware/session');
const { PLANTS } = require('../lib/plants');

const router = express.Router();

function uploadImages(req, res, next) {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ errors: [err.message] });
    }
    next();
  });
}

async function cleanupFiles(files) {
  await Promise.all(
    (files || []).map((f) => fs.promises.unlink(f.path).catch(() => {}))
  );
}

const COMPLAINT_TYPES = [
  'Quality',
  'Quantity Shortfall',
  'Packaging',
  'Delivery Delay',
  'Wrong Item',
  'Spoilage',
  'Temperature Issue',
  'Other',
];
const CHANNELS = ['Email', 'Call', 'WhatsApp', 'Portal', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

// Shared by GET / (list) and GET /export so filtering stays identical
// between the on-screen table and the exported file.
function buildComplaintFilterQuery(query) {
  const { sku, customer, plant, status, priority, date_from, date_to, search } = query;
  const clauses = [];
  const params = [];

  if (sku) {
    params.push(`%${sku}%`);
    clauses.push(`sku ILIKE $${params.length}`);
  }
  if (customer) {
    params.push(`%${customer}%`);
    clauses.push(`customer_name ILIKE $${params.length}`);
  }
  if (plant) {
    params.push(plant);
    clauses.push(`plant = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    clauses.push(`priority_final = $${params.length}`);
  }
  if (date_from) {
    params.push(date_from);
    clauses.push(`date_received >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    clauses.push(`date_received <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    clauses.push(`(customer_name ILIKE $${i} OR sku ILIKE $${i} OR description ILIKE $${i} OR invoice_number ILIKE $${i})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function validateComplaintInput(body) {
  const errors = [];
  const required = ['date_received', 'customer_name', 'sku', 'plant', 'complaint_type', 'channel', 'description', 'invoice_number'];
  for (const field of required) {
    if (!body[field] || String(body[field]).trim() === '') {
      errors.push(`${field} is required`);
    }
  }
  if (body.plant && !PLANTS.includes(body.plant)) {
    errors.push(`plant must be one of: ${PLANTS.join(', ')}`);
  }
  if (body.complaint_type && !COMPLAINT_TYPES.includes(body.complaint_type)) {
    errors.push(`complaint_type must be one of: ${COMPLAINT_TYPES.join(', ')}`);
  }
  if (body.complaint_type === 'Other' && (!body.complaint_type_other || !body.complaint_type_other.trim())) {