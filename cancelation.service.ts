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
   */
  export class CancelationService {
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
        return {
          success: false,
          message:
            "Não é possível cancelar pedidos com valor acima de R$ 1.000,00",
        };
      }
  
      if (order.status === "CANCELED") {
        return {
          success: false,
          message: "Pedido já está cancelado",
        };
      }
  
      //10% do valor do pedido
      const taxForCancel = order.totalAmount / 10
  
      // Simula o cancelamento do pedido
      const canceledOrder = {
        ...order,
        status: "CANCELED",
      };
  
      return {
        success: true,
        message: "Pedido cancelado com sucesso",
        tax: taxForCancel,
        order: canceledOrder,
      };
    }
  }