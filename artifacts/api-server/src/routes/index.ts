import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import proRouter from "./pro";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(proRouter);
router.use(profileRouter);

export default router;
