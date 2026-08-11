class TicketRepository {
    constructor(fakeData) {
        this.fakeData=fakeData
    }
    async reserveStock(data){
        const ticket=this.fakeData.tickets.find(
            ticket=>ticket.id===data.ticketId
        );
        if(!ticket){
            throw new Error ("Ticket not found")
        }
        if(ticket.stock< data.quantity){
            return {
                success:false,
                remainingStock:ticket.stock
            }
        }
        ticket.stock-=data.quantity
        return {
            success:true,
            remainingStock:ticket.stock
        }
    }
    async releaseStock(data){
        const ticket = this.fakeData.tickets.find(ticket=>ticket.id===data.ticketId)
        if(!ticket){
            throw new Error("Ticket not found")
            
        }
        ticket.stock+=data.quantity
        return {
            success:true,
            remainingStock :ticket.stock
        }
    }

}

module.exports = TicketRepository