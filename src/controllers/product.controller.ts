import { Request, Response } from "express";
import Errors from "../libs/Errrors";
import { T } from "../libs/types/common";
import ProductService from "../schema/Product.model";

const productService = new ProductService();

const productController: T = {};

productController.getAllproducts = async (req: Request, res: Response) => {
  try {
    console.log("getAllproducts");
    res.render("products");
  } catch (err) {
    console.log("Error, getAllproducts :", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.stndard.code).json(Errors.stndard);
  }
};

productController.createNewProduct = async (req: Request, res: Response) => {
  try {
    console.log("createNewProduct");
  } catch (err) {
    console.log("Error, createNewProduct  :", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.stndard.code).json(Errors.stndard);
  }
};

productController.updateChosenProduct = async (req: Request, res: Response) => {
  try {
    console.log("updateChosenProduct");
  } catch (err) {
    console.log("Error, updateChosenProduct  :", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.stndard.code).json(Errors.stndard);
  }
};

export default productController;
