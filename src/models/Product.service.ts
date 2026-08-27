import { ProductStatus } from "../libs/enums/product.enum";
import { shapeIntoMongooseObjectId } from "../libs/config";
import Errors, { HttpCode, Message } from "../libs/Errrors";
import { T } from "../libs/types/common";
import {
  Product,
  ProductInput,
  ProductInquiry,
  ProductUpdateInput,
} from "../libs/types/product";
import ProductModel from "../schema/Product.model";
import { ObjectId } from "mongoose";
import ViewModel from "../schema/View.model";
import ViewService from "./View.service";
import { ViewInput } from "../libs/types/view";
import { ViewGroup } from "../libs/enums/View.enum";

class ProductService {
  private readonly productModel;
  public viewService;

  constructor() {
    this.productModel = ProductModel;
    this.viewService = new ViewService();
  }

  /* SPA */
  public async getProducts(inquiry: ProductInquiry): Promise<{
    products: Product[];
    total: number;
  }> {
    const match: T = { productStatus: ProductStatus.PROCESS };

    if (inquiry.search) {
      match.productTitle = {
        $regex: new RegExp(inquiry.search, "i"),
      };
    }

    if (inquiry.productFormat) {
      match.productFormat = inquiry.productFormat;
    }

    if (inquiry.productGenre) {
      match.productGenre = inquiry.productGenre;
    }

    const sort: T =
      inquiry.order === "productPrice"
        ? { [inquiry.order]: 1 }
        : { [inquiry.order]: -1 };

    const totalResult = await this.productModel
      .aggregate([{ $match: match }, { $count: "total" }])
      .exec();

    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    const products = await this.productModel
      .aggregate([
        { $match: match },
        { $sort: sort },
        { $skip: (inquiry.page * 1 - 1) * inquiry.limit },
        { $limit: inquiry.limit * 1 },
      ])
      .exec();

    return {
      products,
      total,
    };
  }

  public async getProduct(
    memberId: ObjectId | null,
    id: string,
  ): Promise<Product> {
    const productId = shapeIntoMongooseObjectId(id);

    let result = await this.productModel
      .findOne({
        _id: productId,
        productStatus: ProductStatus.PROCESS,
      })
      .exec();

    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    if (memberId) {
      // Check Existence
      const input: ViewInput = {
        memberId: memberId,
        viewRefId: productId,
        viewGroup: ViewGroup.PRODUCT,
      };
      const existView = await this.viewService.checkViewExistence(input);

      console.log("existView:", !!existView);
      if (!existView) {
        // Insert View
        console.log("PLANNING TO INSERT NEW VIEW");

        console.log("Before insert");
        await this.viewService.insertMemberView(input);

        console.log("After insert");
        // Increase Counts
        result = await this.productModel
          .findByIdAndUpdate(
            productId,
            { $inc: { productViews: +1 } },
            { new: true },
          )
          .exec();
      }
    }
    return result;
  }

  /* SSR */

  public async getAllproducts(): Promise<Product[]> {
    const result = await this.productModel.find().exec();

    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async createNewProduct(input: ProductInput): Promise<Product> {
    try {
      return await this.productModel.create(input);
    } catch (err) {
      console.log("ERROR:", err);
      console.log("Error, model:createNewProduct:", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async updateChosenProduct(
    id: string,
    input: ProductUpdateInput,
  ): Promise<Product> {
    id = shapeIntoMongooseObjectId(id);

    const result = await this.productModel
      .findOneAndUpdate({ _id: id }, input, { new: true })
      .exec();

    if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

    return result;
  }
}

export default ProductService;
