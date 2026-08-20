import dashboardHandler from "./lib/dashboard-engine.js";

export default async function handler(req, res) {
  return dashboardHandler(req, res);
}
