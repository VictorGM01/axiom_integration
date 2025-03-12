import {
    FastifyInstance,
    FastifyPluginAsync,
    RouteShorthandOptions,
  } from "fastify";
  import { Type, Static } from "@sinclair/typebox";
  import { CancelationService, Order } from "./cancelation.service";
  import swagger from "@fastify/swagger";
  import apiReference from "@scalar/fastify-api-reference";
  
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
   */
  const cancelationController: FastifyPluginAsync = async (
    fastify: FastifyInstance
  ) => {
    const cancelationService = new CancelationService();
  
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
  };
  
  export default cancelationController;