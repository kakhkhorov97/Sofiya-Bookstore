import express, { Router } from "express";
const router = express.Router();
import memberController from "./controllers/member.contoller";

/** Member  */
router.post("/member/login", memberController.login);
router.post("/member/signup", memberController.signup);
router.get("/member/detail", memberController.verifyAuth);

/** Products  */

/** Order*/

export default router;
