import express from "express";
const routerAdmin = express.Router();
import storeController from "./controllers/store.contoller";
import productController from "./controllers/product.controller";
import makeUploader from "./libs/utils/uploader";

/** Restaurant  */
routerAdmin.get("/", storeController.goHome);
routerAdmin
  .get("/login", storeController.getLogin)
  .post("/login", storeController.processLogin);
routerAdmin
  .get("/signup", storeController.getSignup)
  .post(
    "/signup",
    makeUploader("members").single("memberImage"),
    storeController.processSignup,
  );

routerAdmin.get("/logout", storeController.logout);
routerAdmin.get("/check-me", storeController.checkAuthSession);

/** Product  */
routerAdmin.get(
  "/product/all",
  storeController.verifyRestaurant,
  productController.getAllproducts,
);

routerAdmin.post(
  "/product/create",
  storeController.verifyRestaurant,
  makeUploader("products").array("productImages", 5),
  productController.createNewProduct,
);
routerAdmin.post(
  "/product/:id",
  storeController.verifyRestaurant,
  productController.updateChosenProduct,
);
/** User  */

routerAdmin.get(
  "/user/all",
  storeController.verifyRestaurant,
  storeController.getUsers,
);

routerAdmin.post(
  "/user/edit",
  storeController.verifyRestaurant,
  storeController.updataChosenUser,
);

export default routerAdmin;
