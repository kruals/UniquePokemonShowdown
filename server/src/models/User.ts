import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  rating: number;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rating: { type: Number, default: 1000 } // Начальный рейтинг
});

export default mongoose.model<IUser>('User', UserSchema);