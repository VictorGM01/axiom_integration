import {
  FastifyInstance,
  FastifyPluginAsync,
  RouteShorthandOptions,
} from "fastify";
import { Type, Static } from "@sinclair/typebox";
import { CancelationService, Order } from "./cancelation.service";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import { createAxiomServices } from "./axiom";

// Schema definitions using TypeBox (Fastify's recommended JSON Schema builder)
const OrderSchema = Type.Object({
  id: Type.String(),
  totalAmount: Type.Number(),
  status: Type.String(),
});

const CancelResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  tax: Type.Optional(Type.Number()),
  order: Type.Optional(OrderSchema),
});

// Type definitions from schemas
type OrderType = Static<typeof OrderSchema>;
type CancelResponseType = Static<typeof CancelResponseSchema>;

/**
 * Controlador para gerenciar as requisições de cancelamento de pedidos
 * Integrado com Axiom para logging de tentativas
 * @version 1.0.0
 */
const cancelationController: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Inicializar serviços Axiom para logging
  const { cancellationLogService, healthCheck } = createAxiomServices();

  // Inicializar o serviço de cancelamento com o logger do Axiom
  const cancelationService = new CancelationService(cancellationLogService);

  // Registrar indicador de saúde da integração com Axiom
  fastify.addHook("onReady", () => {
    fastify.log.info("Iniciando health check da integração com Axiom");

    // Adicionar listener para eventos de mudanças no status
    healthCheck.on("status-changed", ({ oldStatus, newStatus, timestamp }) => {
      fastify.log.info(
        `Status da integração Axiom alterado de ${oldStatus} para ${newStatus} em ${timestamp}`
      );
    });

    // Log quando a conexão se tornar indisponível
    healthCheck.on("unhealthy", () => {
      fastify.log.error(
        "Integração com Axiom está indisponível. Logs de cancelamentos podem ser perdidos."
      );
    });
  });

  // OpenAPI documentation setup
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "API de Cancelamento de Pedidos",
        version: "1.0.0",
        description:
          "API para gerenciar o cancelamento de pedidos com regras de negócio específicas",
      },
      tags: [
        {
          name: "cancelamento",
          description: "Operações relacionadas ao cancelamento de pedidos",
        },
        {
          name: "monitoramento",
          description:
            "Operações relacionadas ao monitoramento da API e integrações",
        },
        {
          name: "estatísticas",
          description: "Operações relacionadas a estatísticas de cancelamentos",
        },
      ],
    },
  });

  // Register Scalar API Reference
  await fastify.register(apiReference, {
    configuration: {
      page: {
        title: "API de Cancelamento de Pedidos",
        description: "Documentação da API de cancelamento de pedidos",
      },
      theme: {
        colors: {
          primary: {
            main: "#6366F1",
          },
        },
      },
    },
  });

  // Route to cancel an order
  fastify.post<{ Body: OrderType; Reply: CancelResponseType }>(
    "/cancel",
    {
      schema: {
        tags: ["cancelamento"],
        description:
          "Tenta cancelar um pedido com base nas regras de negócio. Pedidos com valor acima de R$ 1.000,00 não podem ser cancelados.",
        body: OrderSchema,
        response: {
          200: CancelResponseSchema,
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const result = cancelationService.cancelOrder(request.body);
      return result;
    }
  );

  // Route to check if an order can be cancelled
  fastify.get<{
    Params: { id: string; totalAmount: string };
    Reply: { canCancel?: boolean; message?: string; error?: string };
  }>(
    "/can-cancel/:id/:totalAmount",
    {
      schema: {
        tags: ["cancelamento"],
        description:
          "Verifica se um pedido pode ser cancelado com base no valor total",
        params: Type.Object({
          id: Type.String(),
          totalAmount: Type.String({
            pattern: "^\\d+(\\.\\d{1,2})?$", // Validates decimal numbers with up to 2 decimal places
          }),
        }),
        response: {
          200: Type.Object({
            canCancel: Type.Boolean(),
            message: Type.String(),
          }),
          400: Type.Object({
            error: Type.String(),
          }),
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const amount = parseFloat(request.params.totalAmount);

      // Additional validation for amount
      if (isNaN(amount) || amount < 0) {
        return reply.code(400).send({
          error: "Invalid amount parameter. Must be a positive number.",
        });
      }

      const order: Order = {
        id: request.params.id,
        totalAmount: amount,
        status: "PENDING",
      };

      const canCancel = cancelationService.canCancelOrder(order);

      return {
        canCancel,
        message: canCancel
          ? "Pedido pode ser cancelado"
          : "Pedido não pode ser cancelado (valor acima de R$ 1.000,00)",
      };
    }
  );

  // Route to check integration health
  fastify.get(
    "/health/axiom",
    {
      schema: {
        tags: ["monitoramento"],
        description: "Verifica o status da integração com Axiom para logging",
        response: {
          200: Type.Object({
            status: Type.String(),
            healthy: Type.Boolean(),
          }),
          503: Type.Object({
            status: Type.String(),
            healthy: Type.Boolean(),
          }),
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const status = healthCheck.getStatus();
      const healthy = status === "healthy";

      if (!healthy) {
        reply.code(503);
      }

      return {
        status,
        healthy,
      };
    }
  );

  // Route to get cancellation statistics
  fastify.get(
    "/stats/cancellations",
    {
      schema: {
        tags: ["estatísticas"],
        description: "Obtém estatísticas sobre tentativas de cancelamento",
        querystring: Type.Object({
          startDate: Type.Optional(Type.String({ format: "date-time" })),
          endDate: Type.Optional(Type.String({ format: "date-time" })),
        }),
        response: {
          200: Type.Object({
            totalAttempts: Type.Number(),
            successfulCancellations: Type.Number(),
            failedCancellations: Type.Number(),
            successRate: Type.Number(),
            averageTax: Type.Number(),
            totalTaxCollected: Type.Number(),
            averageOrderAmount: Type.Number(),
            topFailureReason: Type.Optional(Type.String()),
          }),
          500: Type.Object({
            error: Type.String(),
          }),
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const now = new Date();
      const defaultStartDate = new Date(now);
      defaultStartDate.setDate(now.getDate() - 30); // 30 days ago

      const startTime = startDate || defaultStartDate.toISOString();
      const endTime = endDate || now.toISOString();

      try {
        const stats = await cancellationLogService.getCancellationStats(
          startTime,
          endTime
        );
        return stats;
      } catch (error) {
        fastify.log.error(`Erro ao obter estatísticas: ${error}`);
        return reply.code(500).send({
          error: "Falha ao obter estatísticas de cancelamentos",
        });
      }
    }
  );

  // Route to get successful cancellations
  fastify.get(
    "/logs/cancellations/successful",
    {
      schema: {
        tags: ["estatísticas"],
        description: "Obtém logs de cancelamentos bem-sucedidos",
        querystring: Type.Object({
          startDate: Type.Optional(Type.String({ format: "date-time" })),
          endDate: Type.Optional(Type.String({ format: "date-time" })),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
        }),
        response: {
          200: Type.Array(
            Type.Object({
              orderId: Type.String(),
              totalAmount: Type.Number(),
              orderStatus: Type.String(),
              success: Type.Boolean(),
              message: Type.String(),
              tax: Type.Optional(Type.Number()),
              timestamp: Type.String({ format: "date-time" }),
              clientIp: Type.Optional(Type.String()),
              userAgent: Type.Optional(Type.String()),
            })
          ),
          500: Type.Object({
            error: Type.String(),
          }),
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const { startDate, endDate, limit } = request.query as {
        startDate?: string;
        endDate?: string;
        limit?: number;
      };

      const now = new Date();
      const defaultStartDate = new Date(now);
      defaultStartDate.setDate(now.getDate() - 7); // 7 days ago

      const startTime = startDate || defaultStartDate.toISOString();
      const endTime = endDate || now.toISOString();
      const resultLimit = limit || 100;

      try {
        const logs = await cancellationLogService.getSuccessfulCancellations(
          startTime,
          endTime,
          resultLimit
        );
        return logs;
      } catch (error) {
        fastify.log.error(
          `Erro ao obter logs de cancelamentos bem-sucedidos: ${error}`
        );
        return reply.code(500).send({
          error: "Falha ao obter logs de cancelamentos bem-sucedidos",
        });
      }
    }
  );

  // Route to get failed cancellations
  fastify.get(
    "/logs/cancellations/failed",
    {
      schema: {
        tags: ["estatísticas"],
        description: "Obtém logs de tentativas de cancelamentos que falharam",
        querystring: Type.Object({
          startDate: Type.Optional(Type.String({ format: "date-time" })),
          endDate: Type.Optional(Type.String({ format: "date-time" })),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
        }),
        response: {
          200: Type.Array(
            Type.Object({
              orderId: Type.String(),
              totalAmount: Type.Number(),
              orderStatus: Type.String(),
              success: Type.Boolean(),
              message: Type.String(),
              failureReason: Type.Optional(Type.String()),
              timestamp: Type.String({ format: "date-time" }),
              clientIp: Type.Optional(Type.String()),
              userAgent: Type.Optional(Type.String()),
            })
          ),
          500: Type.Object({
            error: Type.String(),
          }),
        },
      },
    } as RouteShorthandOptions,
    async (request, reply) => {
      const { startDate, endDate, limit } = request.query as {
        startDate?: string;
        endDate?: string;
        limit?: number;
      };

      const now = new Date();
      const defaultStartDate = new Date(now);
      defaultStartDate.setDate(now.getDate() - 7); // 7 days ago

      const startTime = startDate || defaultStartDate.toISOString();
      const endTime = endDate || now.toISOString();
      const resultLimit = limit || 100;

      try {
        const logs = await cancellationLogService.getFailedCancellations(
          startTime,
          endTime,
          resultLimit
        );
        return logs;
      } catch (error) {
        fastify.log.error(
          `Erro ao obter logs de cancelamentos falhos: ${error}`
        );
        return reply.code(500).send({
          error: "Falha ao obter logs de cancelamentos falhos",
        });
      }
    }
  );
};

export default cancelationController;
