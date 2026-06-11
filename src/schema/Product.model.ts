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

    ProductVolume: {
      type: String,
      enum: ProductSize,
      default: ProductVolume.ONE,
    },

    ProductDecs: {
      type: String,
      required: true,
    },

    ProductImages: {
      type: [String],
      default: [],
    },

    ProducViews: {
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
