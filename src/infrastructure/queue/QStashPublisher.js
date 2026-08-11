class QStashPublisher {
    async publish (data) {
        console.log("🚀 ~ QStashPublisher ~ publish ~ data:", data)
        return {
            success :true
        }
    }
}
module.exports = QStashPublisher;