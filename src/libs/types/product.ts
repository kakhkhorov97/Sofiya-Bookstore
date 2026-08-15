import { ObjectId } from "mongoose";
import {
  ProductFormat,
  ProductGenre,
  ProductStatus,
} from "../enums/product.enum";

export interface Product {
  _id: ObjectId;
  productStatus: ProductStatus;
  productAuthor: string;
  productTitle: string;
  productFormat: ProductFormat;
  productGenre: ProductGenre;
  productPrice: number;
  productLeftCount: number;
  productDecs: string;
  productImages: string[];
  productViews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInquiry {
  order: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ProductInput {
  productStatus: ProductStatus;
  productFormat: ProductFormat;
  productTitle: string;
  productPrice: number;
  productLeftCount: number;
  productGenre: ProductGenre;
  productImages: string[];
  productDecs: string;
  productViews: number;
}

export interface ProductUpdateInput {
  _id: ObjectId;
  productStatus?: ProductStatus;
  productFormat?: ProductFormat;
  productTitle?: string;
  productPrice?: number;
  productLeftCount?: number;
  productGenre?: ProductGenre;
  productImages?: string[];
  productDecs?: string;
  productViews?: number;
}
