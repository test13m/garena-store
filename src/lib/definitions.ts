import { type ObjectId } from 'mongodb';

// Represents a user account created via username/password on the /account page.
// This is the account that has a wallet and can generate referral codes.
// This is stored in the 'legacy_users' collection.
export interface LegacyUser {
  _id: ObjectId;
  username: string;
  password:  string;
  referralCode?: string;
  referredBy?: string;
  walletBalance?: number;
  createdAt: Date;
}

// Represents a gaming profile, created when a user first enters their Gaming ID.
// This is used for making purchases and tracking coins. It is NOT a full user account.
// This is stored in the 'users' collection.
export interface User {
    _id: ObjectId;
    gamingId: string;
    coins: number;
    referredByCode?: string; // This will store the referral code of the referrer
    createdAt: Date;
    giftPassword?: string; // Hashed password for securing coin transfers
    canSetGiftPassword?: boolean; // Flag to check if user can set/reset gift password
    isBanned?: boolean;
    banMessage?: string; // A message to show the user when they are banned
}


export interface Product {
    _id: ObjectId; // From MongoDB
    name: string;
    price: number;
    purchasePrice?: number; // Special price for coin products
    quantity: number;
    imageUrl: string;
    dataAiHint?: string;
    isAvailable: boolean;
    isVanished: boolean;
    coinsApplicable?: number;
    isCoinProduct?: boolean;
    endDate?: Date;
    displayOrder?: number;
    category?: string;
    onlyUpi?: boolean;
    oneTimeBuy?: boolean;
}

export interface Order {
    _id: ObjectId;
    userId: string; // The unique ID of the Gaming ID profile document from 'users'
    gamingId: string;
    productId: string;
    productName: string;
    productPrice: number;
    productImageUrl: string;
    paymentMethod: 'UPI' | 'Redeem Code';
    status: 'Processing' | 'Completed' | 'Failed';
    utr?: string;
    redeemCode?: string;
    referralCode?: string; // This will store the referral code of the referrer
    coinsUsed: number;
    finalPrice: number;
    isCoinProduct?: boolean;
    createdAt: Date;
    coinsAtTimeOfPurchase?: number; // Record user's coin balance at the time of purchase
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
