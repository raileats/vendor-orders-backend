require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret';

// In-memory data (simulate aggregated orders from Zomato, Swiggy, Dominos...)
const vendors = [
  {id: 'v1', name: 'Pait Pooja', phone: '9876543210'},
  {id: 'v2', name: 'MIG Mayo', phone: '9876501234'}
];

const aggregatedOrders = [
  {id:'o1', vendorId:'v1', platform:'Zomato', orderId:'Z-1001', customer:'Aman', phone:'9999000001', amount:250, status:'NEW', created_at:new Date().toISOString()},
  {id:'o2', vendorId:'v1', platform:'Swiggy', orderId:'S-2010', customer:'Neha', phone:'9999000002', amount:350, status:'NEW', created_at:new Date().toISOString()},
  {id:'o3', vendorId:'v2', platform:'Dominos', orderId:'D-5003', customer:'Ravi', phone:'9999000003', amount:499, status:'DELIVERED', created_at:new Date().toISOString()},
  {id:'o4', vendorId:'v1', platform:'Pizza Hut', orderId:'P-3005', customer:'Sita', phone:'9999000004', amount:199, status:'CANCELLED', created_at:new Date().toISOString()}
];

// OTP store (in-memory) - in real app use DB + SMS provider
const otpStore = {}; // phone -> otp

app.get('/api/health', (req,res)=> res.json({ok:true}));

app.post('/api/auth/send-otp', (req,res)=>{
  const {phone} = req.body || {};
  if(!phone) return res.status(400).json({error:'phone required'});
  // generate 6-digit OTP (demo: always 123456 for convenience)
  const otp = '123456';
  otpStore[phone] = otp;
  console.log('Generated OTP for', phone, otp);
  // In production send SMS here (Twilio/MSG91 etc.)
  return res.json({ok:true, message:'OTP sent (demo)', otpDemo: otp});
});

app.post('/api/auth/verify-otp', (req,res)=>{
  const {phone, otp} = req.body || {};
  if(!phone || !otp) return res.status(400).json({error:'phone and otp required'});
  const expected = otpStore[phone];
  if(!expected || otp !== expected) return res.status(400).json({error:'invalid otp'});
  delete otpStore[phone];
  // find or create vendor
  let vendor = vendors.find(v=>v.phone===phone);
  if(!vendor){
    vendor = {id:'v'+(vendors.length+1), name:'New Vendor', phone};
    vendors.push(vendor);
  }
  const token = jwt.sign({vendorId: vendor.id}, JWT_SECRET, {expiresIn:'30d'});
  res.json({ok:true, token, vendor});
});

function auth(req,res,next){
  const h = req.headers.authorization || '';
  const t = h.split(' ')[1];
  if(!t) return res.status(401).json({error:'no auth'});
  try{
    const dec = jwt.verify(t, JWT_SECRET);
    req.vendorId = dec.vendorId;
    next();
  }catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// vendor profile
app.get('/api/user/profile', auth, (req,res)=>{
  const v = vendors.find(x=>x.id===req.vendorId);
  res.json({ok:true, vendor: v});
});

// vendor orders aggregated from platforms
app.get('/api/orders', auth, (req,res)=>{
  const vendorId = req.vendorId;
  const {platform, status, q} = req.query;
  let list = aggregatedOrders.filter(o=>o.vendorId === vendorId);
  if(platform) list = list.filter(o=>o.platform===platform);
  if(status) list = list.filter(o=>o.status===status);
  if(q){
    const s = q.toLowerCase();
    list = list.filter(o => (o.orderId||'').toLowerCase().includes(s) || (o.customer||'').toLowerCase().includes(s));
  }
  res.json({ok:true, orders: list});
});

// For testing: add a new order (simulate ingestion)
app.post('/api/orders', (req,res)=>{
  const o = req.body || {};
  o.id = 'o'+(aggregatedOrders.length+1);
  o.created_at = new Date().toISOString();
  aggregatedOrders.push(o);
  res.json({ok:true, order:o});
});

const port = process.env.PORT || 4000;
app.listen(port, ()=> console.log('Server running on', port));
