import { Application } from "../vendor/stimulus.js"
import LifeController from "./controllers/life_controller.js"
import RiverController from "./controllers/river_controller.js"

const application = Application.start()
application.register("life", LifeController)
application.register("river", RiverController)
