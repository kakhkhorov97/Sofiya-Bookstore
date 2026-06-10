import { Request, Response } from "express";
import { T } from "../libs/types/common";
import { LoginInput, Member, MemberInput } from "../libs/types/member";
import MemberService from "../models/Member.service";
import Errors from "../libs/Errrors";

const memberService = new MemberService();

//REACT
const memberController: T = {};

memberController.signup = async (req: Request, res: Response) => {
  try {
    console.log("signup");

    const input: MemberInput = req.body,
      result: Member = await memberService.signup(input);

    //TODO:TOKEN

    res.json({ member: result });
  } catch (err) {
    console.log("Error, signup:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.stndard.code).json(Errors.stndard);
  }
};

memberController.login = async (req: Request, res: Response) => {
  try {
    console.log("login");
    const input: LoginInput = req.body,
      result = await memberService.login(input);

    //TODO:TOKEN

    res.json({ member: result });
  } catch (err) {
    console.log("Error, login:", err);
    res.send(err);
  }
};

export default memberController;
