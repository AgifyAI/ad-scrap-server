import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '@/common/utils/envConfig';

export const tokenAuth = (req: Request, res: Response, next: NextFunction) => {
  // Récupérer le token depuis l'header Authorization ou le query parameter
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const tokenFromQuery = req.query.token as string;

  const token = tokenFromHeader || tokenFromQuery;

  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Token required. Provide it in Authorization header (Bearer token) or as query parameter (?token=...)',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
    return;
  }

  if (token !== env.SCRAP_API_TOKEN) {
    res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Invalid token',
      statusCode: StatusCodes.FORBIDDEN,
    });
    return;
  }

  next();
};
