import { ICancellationLogService, CancellationLog } from "./axiom/interfaces";

/**
 * Interface que representa um pedido para o serviço de cancelamento
 */
export interface Order {
  id: string;
  totalAmount: number;
  status: string;
}

/**
 * Classe responsável por gerenciar o cancelamento de pedidos
 * Implementa a regra de negócio: pedidos com valor acima de R$ 1.000,00 não podem ser cancelados
 * @version 1.0.0
 */
export class CancelationService {
  /**
   * @param {ICancellationLogService} [logService] - Serviço de logging para cancelamentos (opcional)
   */
  constructor(private readonly logService?: ICancellationLogService) {}

  /**
   * Verifica se um pedido pode ser cancelado com base no valor total
   * @param order Pedido a ser verificado
   * @returns true se o pedido pode ser cancelado, false caso contrário
   */
  canCancelOrder(order: Order): boolean {
    // Regra de negócio: pedidos com valor acima de R$ 1.000,00 não podem ser cancelados
    return order.totalAmount <= 1000;
  }

  /**
   * Tenta cancelar um pedido
   * @param order Pedido a ser cancelado
   * @returns Objeto com o resultado da operação
   */
  cancelOrder(order: Order): {
    success: boolean;
    message: string;
    tax?: number;
    order?: Order;
  } {
    if (!this.canCancelOrder(order)) {
      const result = {
        success: false,
        message:
          "Não é possível cancelar pedidos com valor acima de R$ 1.000,00",
      };

      // Log do cancelamento falho
      this.logCancellationAttempt({
        ...result,
        orderId: order.id,
        totalAmount: order.totalAmount,
        orderStatus: order.status,
        failureReason: "Valor acima do limite permitido",
      });

      return result;
    }

    if (order.status === "CANCELED") {
      const result = {
        success: false,
        message: "Pedido já está cancelado",
      };

      // Log do cancelamento falho
      this.logCancellationAttempt({
        ...result,
        orderId: order.id,
        totalAmount: order.totalAmount,
        orderStatus: order.status,
        failureReason: "Pedido já cancelado",
      });

      return result;
    }

    //10% do valor do pedido
    const taxForCancel = order.totalAmount / 10;

    // Simula o cancelamento do pedido
    const canceledOrder = {
      ...order,
      status: "CANCELED",
    };

    const result = {
      success: true,
      message: "Pedido cancelado com sucesso",
      tax: taxForCancel,
      order: canceledOrder,
    };

    // Log do cancelamento bem-sucedido
    this.logCancellationAttempt({
      ...result,
      orderId: order.id,
      totalAmount: order.totalAmount,
      orderStatus: canceledOrder.status,
    });

    return result;
  }

  /**
   * Log do resultado da tentativa de cancelamento
   * @private
   * @param logData Dados para o log
   */
  private logCancellationAttempt(logData: {
    success: boolean;
    message: string;
    orderId: string;
    totalAmount: number;
    orderStatus: string;
    tax?: number;
    failureReason?: string;
  }): void {
    // Se não há serviço de log, retorna sem fazer nada
    if (!this.logService) {
      return;
    }

    try {
      // Cria o objeto de log
      const log: CancellationLog = {
        orderId: logData.orderId,
        totalAmount: logData.totalAmount,
        orderStatus: logData.orderStatus,
        success: logData.success,
        message: logData.message,
        timestamp: new Date().toISOString(),
      };

      // Adiciona taxa para cancelamentos bem-sucedidos
      if (logData.success && logData.tax !== undefined) {
        log.tax = logData.tax;
      }

      // Adiciona razão da falha para cancelamentos falhos
      if (!logData.success && logData.failureReason) {
        log.failureReason = logData.failureReason;
      }

      // Adiciona informações do cliente se disponíveis
      if (typeof window !== "undefined") {
        log.userAgent = window.navigator.userAgent;
      }

      // Envia o log para o serviço
      this.logService.logCancellationAttempt(log).catch((error) => {
        console.error("Falha ao registrar tentativa de cancelamento:", error);
      });
    } catch (error) {
      console.error("Erro ao preparar log de cancelamento:", error);
    }
  }
}
