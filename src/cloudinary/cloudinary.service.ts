    import { Injectable } from '@nestjs/common';
    import { v2 as cloudinary } from 'cloudinary';
    import * as streamifier from 'streamifier';

    export interface UploadedFile {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    }

    @Injectable()
    export class CloudinaryService {
    uploadImage(file: UploadedFile): Promise<any> {
        return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'avatars', transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }] },
            (error, result) => {
            if (error) return reject(error);
            resolve(result);
            },
        );
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }
    }