

class BuyTicketUseCase {
    constructor(ticketRepository, orderCodeGenerator,queuePublisher) {
        this.ticketRepository = ticketRepository;
        this.orderCodeGenerator = orderCodeGenerator;
        this.queuePublisher = queuePublisher;
    }
  async execute(data) {
  console.log("3. UseCase start");

  const result =
    await this.ticketRepository.reserveStock(data);

  console.log("4. reserveStock result:", result);

  if (!result.success) {
    throw new Error("Not enough stock");
  }

  try {
    console.log("5. Generate order code");

    const orderCode =
      this.orderCodeGenerator.generate();

    console.log("6. Order code:", orderCode);

    console.log("7. Publish queue");

    await this.queuePublisher.publish({
      orderCode,
      ...data
    });

    console.log("8. Publish success");

    return {
      success: true,
      orderCode
    };

  } catch (error) {
    console.log("9. ERROR:", error);

    await this.ticketRepository.releaseStock(data);

    throw error;
  }
}

    
}
module.exports = BuyTicketUseCase;