
# xxxx.com — Flash Sale Ticket System

Project thực hành xây dựng hệ thống đặt vé flash sale chịu tải cao theo DDD. Bài toán chính là bán vé sự kiện — stock giới hạn, nhiều người đặt cùng lúc, không được oversell, server không được sập.

---

## Vì sao dự án này tồn tại?

Anh em thử nhớ lại lần gần nhất canh giờ vàng Shopee xem, kiểu 9.9, 10.10, 11.11, 12.12 hay mấy phiên live săn deal 1k đó. Đúng giờ, bấm nút, xong hết hàng. Chưa đầy vài giây. Quen không?

Đằng sau cái cảm giác "chớp mắt là hết hàng" đó là một bài toán kỹ thuật không nhẹ nhàng chút nào: hàng nghìn, hàng chục nghìn request đổ vào cùng một giây, tranh nhau một mớ tồn kho ít ỏi, mà hệ thống thì không được sập, cũng không được bán vượt kho (oversell). Nói cho gọn thì seckill hay flash sale gì đó, thực ra chỉ là bài toán xử lý đồng thời (high concurrency) được đóng gói lại cho dễ hình dung thôi.

Cái hay là dự án của anh em có làm seckill hay không thì năng lực xử lý đồng thời vẫn phải có. Vì sớm muộn gì cũng đụng thôi, traffic tăng đột biến, chạy campaign marketing, hoặc tự dưng một hôm app lên trend. Học sớm được ngày nào hay ngày đó, đừng để tới lúc production sập mới ngồi học.

Tài liệu về seckill trên mạng thì không thiếu, nhưng đọc xong vẫn chưa biết bắt tay code kiểu gì. Đa phần chỉ dừng ở lý thuyết, thiếu chỗ để "sờ" vào. Nên dự án này làm theo hướng ngược lại, code thẳng một hệ thống đặt vé flash sale từ số 0, đầy đủ DDD, Redis, Kafka, Outbox, SAGA, Idempotency, rate limit, circuit breaker, có cả benchmark ra số liệu hẳn hoi. Vừa đọc code vừa vỡ ra kiểu "à, thì ra pattern này sinh ra để giải quyết đúng cái này".

### Đọc xong anh em có được gì?

- Tư duy thiết kế kiến trúc seckill/flash sale từ đầu tới cuối, không phải nghe cho vui
- Cache 2 tầng: local (Guava Cache) kết hợp phân tán (Redis), dùng cái nào lúc nào và vì sao phải kết hợp cả hai
- Đặt hàng kiểu đồng bộ (CAS trên DB) khi tranh chấp cao, biết luôn giới hạn của cách này
- Đặt hàng bất đồng bộ qua Kafka, xử lý theo event, không bắt người dùng ngồi chờ DB
- Chống bán vượt kho bằng distributed lock (Redisson), cộng ý tưởng chia nhỏ kho theo bucket để giảm tranh chấp
- Rate limiting, circuit breaker (Resilience4j) để chặn từ xa trước khi cả hệ thống sập theo dây chuyền
- Benchmark/load test ra số thật (k6, JMeter) chứ không phải kiểu nói suông "hệ thống chịu tải cao"
- Mấy pattern mà thiếu là dính bug ngay trong hệ phân tán: Outbox, Idempotency Key, SAGA compensating transaction, Order Queue polling
- DDD áp dụng thực chiến, domain sạch, không phụ thuộc ngược vào infrastructure
- Quan sát hệ thống bằng Prometheus, Grafana, ELK, Actuator, code xong phải biết soi nó chạy ra sao

### Vậy ai nên đọc?

- Sinh viên/fresher đã có tí nền Java, Spring, giờ muốn hiểu kiến trúc seckill cho nhanh, khỏi mò mẫm
- Backend dev muốn lên tay về thiết kế hệ thống high concurrency
- Anh em đang ôn phỏng vấn, vì system design về flash sale/seckill là câu hỏi kinh điển, hỏi hoài không chán
- Ai tò mò Shopee, Lazada, Tiki xử lý kiểu gì mà hàng chục nghìn request/giây vẫn không sập, không bán lụt kho

---

Link dự án dưới comment

## Architecture Diagrams