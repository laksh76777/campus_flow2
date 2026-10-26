import { Router } from "express";
import userRouter from "./user.routes.js";
import studentRouter from "./studentProfile.routes.js";
import adminRouter from "./admin.routes.js";
import driveRouter from "./placementDrive.routes.js";
import applicationRouter from "./application.routes.js";
import companyRouter from "./company.routes.js";
import sessionRouter from "./placementSession.routes.js";
import departmentRouter from "./department.routes.js";
import notificationRouter from "./notification.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import excelRouter from "./excel.routes.js";
import supportRouter from "./support.routes.js";

const apiRouter = Router();

apiRouter.use("/users", userRouter);
apiRouter.use("/studentprofile", studentRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/placementdrive", driveRouter);
apiRouter.use("/application", applicationRouter);
apiRouter.use("/company", companyRouter);
apiRouter.use("/sessions", sessionRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/excel", excelRouter);
apiRouter.use("/support", supportRouter);

export default apiRouter;
