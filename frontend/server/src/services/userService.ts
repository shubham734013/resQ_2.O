import { Types } from 'mongoose';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserSavedFacilityModel } from '../models/UserSavedFacility.js';
import { AppError } from '../utils/AppError.js';

const userObjectId=(id:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid user id',400);return new Types.ObjectId(id);};
const facilityObjectId=(id:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid facility id',400);return new Types.ObjectId(id);};

export const listSavedFacilities=async(userId:string)=>{
  const uid=userObjectId(userId);
  const userExists=await UserModel.exists({_id:uid});
  if(!userExists)throw new AppError('NOT_FOUND','User not found',404);

  const savedRecords=await UserSavedFacilityModel.find({userId:uid}).sort({createdAt:-1}).lean().exec();
  const ids=savedRecords.map(r=>r.hospitalId);
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
  const userExists=await UserModel.exists({_id:uid});
  if(!userExists)throw new AppError('NOT_FOUND','User not found',404);

  const facility=await HospitalModel.findOne({_id:fid,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('_id').lean().exec();
  if(!facility)throw new AppError('FACILITY_NOT_ELIGIBLE','Only active and verified facilities can be saved',409);

  await Promise.all([
    UserSavedFacilityModel.findOneAndUpdate(
      {userId:uid,hospitalId:fid},
      {$setOnInsert:{userId:uid,hospitalId:fid,createdAt:new Date()}},
      {upsert:true,returnDocument: 'after'}
    ).exec(),
    UserModel.updateOne({_id:uid},{$addToSet:{savedFacilityIds:fid}}).exec(),
  ]);

  return {saved:true,facilityId:String(fid)};
};

export const removeSavedFacility=async(userId:string,facilityId:string)=>{
  const uid=userObjectId(userId),fid=facilityObjectId(facilityId);
  const userExists=await UserModel.exists({_id:uid});
  if(!userExists)throw new AppError('NOT_FOUND','User not found',404);

  await Promise.all([
    UserSavedFacilityModel.deleteOne({userId:uid,hospitalId:fid}).exec(),
    UserModel.updateOne({_id:uid},{$pull:{savedFacilityIds:fid}}).exec(),
  ]);

  return {saved:false,facilityId:facilityId};
};