class TicketController {
  constructor(buyTicketUseCase) {
    this.buyTicketUseCase = buyTicketUseCase;
  }

  async buy(req, res, next) {
    try {
      console.log("1. Controller nhận request");
      console.log("BODY:", req.body);

      const result =
        await this.buyTicketUseCase.execute(req.body);

      console.log("2. UseCase result:", result);

      res.json(result);
    } catch (error) {
      console.log("Controller ERROR:", error);
      next(error);
    }
  }
}

module.exports = TicketController;