import mongoose, { Schema } from "mongoose";
import {
  ProductFormat,
  ProductGenre,
  ProductStatus,
} from "../libs/enums/product.enum";

const productSchema = new Schema(
  {
    productStatus: {
      type: String,
      enum: ProductStatus,
      default: ProductStatus.PAUSE,
    },

    productAuthor: {
      type: String,
      required: true,
    },

    productTitle: {
      type: String,
      required: true,
    },

    productFormat: {
      type: String,
      enum: ProductFormat,
      required: true,
    },

    productGenre: {
      type: String,
      enum: ProductGenre,
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

    productDecs: {
      type: String,
    },

    productImages: {
      type: [String],
      default: [],
    },

    productViews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

productSchema.index({ productTitle: 1, productFormat: 1 }, { unique: true });

export default mongoose.model("Product", productSchema);
