// Zod validation middleware — validate body/query/params พร้อมกันตาม schema ที่กำหนด
export function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: result.error.flatten().fieldErrors,
      });
    }

    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;
    if (result.data.params !== undefined) req.params = result.data.params;

    next();
  };
}
