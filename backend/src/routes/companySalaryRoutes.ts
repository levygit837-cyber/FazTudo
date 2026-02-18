import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { validateBody } from "../middleware/validate";
import { createSalaryRuleSchema, transferSalarySchema } from "../middleware/validation";
import { getSalaryRules, createSalaryRule, updateSalaryRule, deleteSalaryRule, getSalaryHistory, transferSalary } from "../controllers/companySalaryController";

const router = Router();
router.use(verifyToken);

router.get("/rules", requireCompanyPermission("finance.salary"), getSalaryRules);
router.post("/rules", requireCompanyPermission("finance.salary"), validateBody(createSalaryRuleSchema), createSalaryRule);
router.put("/rules/:ruleId", requireCompanyPermission("finance.salary"), updateSalaryRule);
router.delete("/rules/:ruleId", requireCompanyPermission("finance.salary"), deleteSalaryRule);
router.get("/history/:memberId", requireCompanyPermission("finance.salary"), getSalaryHistory);
router.post("/transfer", requireCompanyPermission("finance.transfer"), validateBody(transferSalarySchema), transferSalary);

export default router;
