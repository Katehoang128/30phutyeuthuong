import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import proRouter from "./pro";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(proRouter);

export default router;
