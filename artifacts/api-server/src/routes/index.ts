import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import proRouter from "./pro";
import profileRouter from "./profile";
import blogRouter from "./blog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(proRouter);
router.use(profileRouter);
router.use(blogRouter);

export default router;
