const fakeData = require("../data/fakeData");

const TicketRepository = require("../domain/repositories/TicketRepository");
const OrderCodeGenerator = require("../domain/services/OrderCodeGenerator");
const QStashPublisher = require("../infrastructure/queue/QStashPublisher");

const BuyTicketUseCase = require("../application/usecases/BuyTicketUseCase");
const TicketController = require("../controllers/TicketController");

// Repository
const ticketRepository = new TicketRepository(fakeData);

// Services
const orderCodeGenerator = new OrderCodeGenerator();

// Infrastructure
const queuePublisher = new QStashPublisher();

// UseCases
const buyTicketUseCase = new BuyTicketUseCase(
    ticketRepository,
    orderCodeGenerator,
    queuePublisher
);
console.log("🚀 ~ buyTicketUseCase:", buyTicketUseCase)

// Controllers
const ticketController = new TicketController(
  buyTicketUseCase
);

module.exports = {
  ticketController,
  buyTicketUseCase
};