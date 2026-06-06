import express, { Router } from "express";
const router = express.Router();
import memberController from "./controllers/member.contoller";


router.post("/login", memberController.login);
router .post("/signup", memberController.signup);

export default router;