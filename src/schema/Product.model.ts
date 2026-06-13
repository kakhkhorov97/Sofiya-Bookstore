import mongoose, { Schema } from "mongoose";
import {
  ProductCollection,
  ProductSize,
  ProductStatus,
  ProductVolume,
} from "../libs/enums/product.enum";

const productSchema = new Schema(
  {
    productStatus: {
      type: String,
      enum: ProductStatus,
      default: ProductStatus.PAUSE,
    },

    productCollection: {
      type: String,
      enum: ProductCollection,
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    productPrice: {
      type: Number,
      required: true,
    },

    productLeftCount: {
      type: Number,
      required: true,
    },

    productSize: {
      type: String,
      enum: ProductSize,
      default: ProductSize.NORMAL,
    },

    productVolume: {
      type: Number,
      enum: ProductSize,
      default: ProductVolume.ONE,
    },

    productDecs: {
      type: String,
    },

    productImages: {
      type: [String],
      default: [],
    },

    producViews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

productSchema.index(
  { ProductName: 1, ProductSize: 1, ProductVolume: 1 },
  { unique: true },
);

export default mongoose.model("Product", productSchema);
