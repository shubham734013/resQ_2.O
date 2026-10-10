import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/healthRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { hospitalRouter } from './routes/hospitalRoutes.js';
import { mapsRouter } from './routes/mapsRoutes.js';
import { geospatialRouter } from './routes/geospatialRoutes.js';
import { facilityRouter } from './routes/facilityRoutes.js';
import { geocodingRouter } from './routes/geocodingRoutes.js';
import { placesRouter } from './routes/placesRoutes.js';
import { ambulanceProviderRouter, ambulanceDriverRouter } from './routes/ambulanceOperationsRoutes.js';
import { emergencyRouter } from './routes/emergencyRoutes.js';
import { realtimeRouter } from './routes/realtimeRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { getAllowedOrigins, mutationOriginGuard, originGuard, securityHeaders } from './middlewares/security.js';

export const app=express();
const allowedOrigins=getAllowedOrigins();

app.disable('x-powered-by');
app.use(securityHeaders);
// Handle CORS preflight before origin/CSRF guards.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    if (allowedOrigins.includes(origin)) { callback(null, true); return; }
    callback(new Error('CORS origin is not allowed'));
  },
  credentials:true,
}));
app.use(originGuard);
app.use(mutationOriginGuard);
app.use(express.urlencoded({extended:false,limit:'100kb'}));
app.use(express.json({limit:'1mb'}));

app.use('/api/v1/health',healthRouter);
app.use('/api/v1/auth',authRouter);
app.use('/api/v1/admin',adminRouter);
app.use('/api/v1/hospital',hospitalRouter);
app.use('/api/v1/users',userRouter);
app.use('/api/v1',geospatialRouter);
app.use('/api/v1/facilities',facilityRouter);
app.use('/api/v1/maps',mapsRouter);
app.use('/api/v1/geocoding',geocodingRouter);
app.use('/api/v1/places',placesRouter);
app.use('/api/v1/ambulance-provider',ambulanceProviderRouter);
app.use('/api/v1/ambulance-driver',ambulanceDriverRouter);
app.use('/api/v1/emergencies',emergencyRouter);
app.use('/api/v1/realtime',realtimeRouter);
app.use((_req,res)=>{res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Route not found'}});});
app.use(errorHandler);
