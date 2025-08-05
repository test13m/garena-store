import { type ObjectId } from 'mongodb';

// This interface is being replaced by the new User interface below.
// export interface User {
//   _id: ObjectId;
//   username: string;
//   password:  string;
//   referralCode?: string;
//   referredBy?: string;
//   walletBalance?: number;
//   createdAt: Date;
// }

export interface User {
    _id: ObjectId;
    gamingId: string;
    coins: number;
    referralCode?: string;
    referredBy?: string; // This will store the username of the referrer from the 'legacy_users' collection
    createdAt: Date;
}


export interface Product {
    _id: string; // From MongoDB
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
    dataAiHint: string;
    isAvailable: boolean;
    isVanished: boolean;
    coinsApplicable: number;
}

export interface Order {
    _id: ObjectId;
    userId: string; // The unique ID of the user document
    gamingId: string;
    productId: string;
    productName: string;
    productPrice: number;
    productImageUrl: string;
    paymentMethod: 'UPI' | 'Redeem Code';
    status: 'Processing' | 'Completed' | 'Failed';
    utr?: string;
    redeemCode?: string;
    referredBy?: string; // This will store the username of the referrer from the 'legacy_users' collection
    coinsUsed: number;
    finalPrice: number;
    createdAt: Date;
}

export interface Withdrawal {
  _id: ObjectId;
  userId: string;
  username: string;
  referralCode?: string;
  amount: number;
  method: 'Bank' | 'UPI';
  details: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  status: 'Pending' | 'Completed' | 'Failed';
  createdAt: Date;
}
