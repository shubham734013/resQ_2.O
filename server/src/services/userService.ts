import { Types } from 'mongoose';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AppError } from '../utils/AppError.js';

const userObjectId=(id:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid user id',400);return new Types.ObjectId(id);};
const facilityObjectId=(id:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid facility id',400);return new Types.ObjectId(id);};

export const listSavedFacilities=async(userId:string)=>{
  const uid=userObjectId(userId);
  const user=await UserModel.findById(uid).select('savedFacilityIds').lean().exec();
  if(!user)throw new AppError('NOT_FOUND','User not found',404);
  const ids=user.savedFacilityIds??[];
  if(!ids.length)return {items:[]};
  const hospitals=await HospitalModel.find({ _id:{$in:ids},accountStatus:'ACTIVE',verificationStatus:'VERIFIED' })
    .select('-passwordHash -email').lean().exec();
  const position=new Map(ids.map((id,index)=>[String(id),index]));
  hospitals.sort((a,b)=>(position.get(String(a._id))??0)-(position.get(String(b._id))??0));
  return {items:hospitals.map((hospital)=>({
    id:String(hospital._id),name:hospital.name,hospitalType:hospital.hospitalType,
    services:hospital.services??[],capabilities:hospital.capabilities??[],
    emergencyAvailability:hospital.emergencyAvailability,address:hospital.address,city:hospital.city,state:hospital.state,country:hospital.country,
    phone:hospital.phone,updatedAt:hospital.updatedAt,
    latitude:typeof hospital.latitude==='number'?hospital.latitude:hospital.location?.coordinates?.[1],
    longitude:typeof hospital.longitude==='number'?hospital.longitude:hospital.location?.coordinates?.[0],
  }))};
};

export const addSavedFacility=async(userId:string,facilityId:string)=>{
  const uid=userObjectId(userId),fid=facilityObjectId(facilityId);
  const facility=await HospitalModel.findOne({_id:fid,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('_id').lean().exec();
  if(!facility)throw new AppError('FACILITY_NOT_ELIGIBLE','Only active and verified facilities can be saved',409);
  const user=await UserModel.findOneAndUpdate({_id:uid},{$addToSet:{savedFacilityIds:fid}},{new:true}).select('savedFacilityIds').lean().exec();
  if(!user)throw new AppError('NOT_FOUND','User not found',404);
  return {saved:true,facilityId:String(fid)};
};

export const removeSavedFacility=async(userId:string,facilityId:string)=>{
  const user=await UserModel.findOneAndUpdate({_id:userObjectId(userId)},{$pull:{savedFacilityIds:facilityObjectId(facilityId)}},{new:true}).select('savedFacilityIds').lean().exec();
  if(!user)throw new AppError('NOT_FOUND','User not found',404);
  return {saved:false,facilityId:facilityId};
};