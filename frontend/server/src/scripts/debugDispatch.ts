import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { UserModel } from '../models/User.js';

async function main() {
  await connectDatabase();
  const emg = await EmergencyRequestModel.findById('6ad07bd166da3928c24a61dd').lean();
  console.log('Emergency 6ad07bd166da3928c24a61dd:', emg);
  if (emg) {
    const user = await UserModel.findById(emg.userId).lean();
    console.log('User associated:', user?.email, user?.role, user?._id);
  }
  await disconnectDatabase();
}
main().catch(console.error);
